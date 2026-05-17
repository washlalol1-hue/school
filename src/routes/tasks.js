// Tasks routes: list daily tasks, complete a task
import { authMiddleware } from '../auth.js';
import { getVipTier, getCompletedTasksToday, completeTask, updateBalance, updateTodayEarnings, addTransaction, getUser, todayStr } from '../db.js';

export async function handleTasks(request, env, path) {
  if (path === '/api/tasks' && request.method === 'GET') {
    return listTasks(request, env);
  }
  const completeMatch = path.match(/^\/api\/tasks\/([^/]+)\/complete$/);
  if (completeMatch && request.method === 'POST') {
    return doComplete(request, env, completeMatch[1]);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

function generateTaskList(vipTier, today, completedIds) {
  const tasks = [];
  const rewardPerTask = vipTier.daily_tasks > 0 ? vipTier.daily_income / vipTier.daily_tasks : 0;
  const videoTitles = [
    'Product Review: Smart Home Devices',
    'Tech Unboxing: Latest Gadgets 2025',
    'Travel Vlog: Hidden Paradise',
    'Cooking Tutorial: Quick Recipes',
    'Fitness Challenge: 10 Min Workout',
    'DIY Crafts: Home Decor Ideas',
    'Gaming Highlights: Top Plays',
    'Music Mix: Chill Beats',
    'Fashion Lookbook: Summer Trends',
    'Science Explained: Space Facts',
    'Car Review: Electric Vehicles',
    'Pet Care: Training Tips',
    'Photography Tutorial: Night Shots',
    'Language Learning: Quick Phrases',
    'Art Tutorial: Watercolor Basics',
    'Dance Tutorial: Easy Steps',
    'Book Review: Must-Read Novels',
    'Gardening Tips: Indoor Plants',
    'Meditation Guide: 5 Minute Calm',
    'History Documentary: Ancient Wonders',
    'Sports Highlights: Best Goals',
    'Home Workout: No Equipment',
    'Movie Review: New Releases',
    'Podcast Episode: Life Lessons',
    'Street Food Tour: Asian Flavors',
    'Nature Documentary: Ocean Life',
    'Comedy Sketch: Daily Laughs',
    'Investment Basics: Beginners Guide',
    'Yoga Flow: Morning Routine',
    'Architecture Tour: Modern Design',
    'Wildlife Safari: African Plains',
    'Skateboard Tricks: Beginner to Pro',
    'Piano Tutorial: Simple Songs',
    'Astronomy Guide: Star Gazing',
    'Surfing Lessons: Wave Riding',
    'Drone Footage: City Skylines',
    'Martial Arts: Basic Moves',
    'Woodworking: Simple Projects',
    'Painting Tutorial: Landscapes',
    'Camping Guide: Survival Tips',
  ];

  for (let i = 0; i < vipTier.daily_tasks; i++) {
    const taskId = `task-${today}-${i}`;
    tasks.push({
      id: taskId,
      title: videoTitles[i % videoTitles.length],
      reward: Math.round(rewardPerTask * 100) / 100,
      videoSrc: `assets/videos/task-${i}.mp4`,
      completed: completedIds.includes(taskId),
    });
  }
  return tasks;
}

async function listTasks(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const tier = await getVipTier(env.DB, user.vip_level);
  if (!tier) {
    return new Response(JSON.stringify({ tasks: [], vipLevel: 0 }));
  }

  const today = todayStr();
  const completed = await getCompletedTasksToday(env.DB, user.id, today);
  const completedIds = completed.map(c => c.task_id);
  const tasks = generateTaskList(tier, today, completedIds);

  return new Response(JSON.stringify({ tasks, vipLevel: user.vip_level }));
}

async function doComplete(request, env, taskId) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const tier = await getVipTier(env.DB, user.vip_level);
  if (!tier) {
    return new Response(JSON.stringify({ error: 'No VIP package active' }), { status: 400 });
  }

  const today = todayStr();
  const completed = await getCompletedTasksToday(env.DB, user.id, today);
  if (completed.find(c => c.task_id === taskId)) {
    return new Response(JSON.stringify({ error: 'Task already completed' }), { status: 400 });
  }

  if (completed.length >= tier.daily_tasks) {
    return new Response(JSON.stringify({ error: 'All daily tasks completed' }), { status: 400 });
  }

  const reward = Math.round((tier.daily_income / tier.daily_tasks) * 100) / 100;

  // Complete the task
  await completeTask(env.DB, user.id, taskId, today, reward);

  // Update user balance and earnings
  await updateBalance(env.DB, user.id, reward);
  await updateTodayEarnings(env.DB, user.id, reward, today);
  await env.DB.prepare(
    'UPDATE users SET total_earnings = total_earnings + ?, completed_tasks = completed_tasks + 1 WHERE id = ?'
  ).bind(reward, user.id).run();

  // Add transaction
  await addTransaction(env.DB, {
    userId: user.id,
    type: 'Task Reward',
    amount: reward,
    status: 'Completed',
    description: `Completed ${taskId}`,
  });

  // Referral commissions (L1: 10%, L2: 5%, L3: 2%)
  await distributeCommissions(env.DB, user.id, reward);

  const updatedUser = await getUser(env.DB, user.id);
  return new Response(JSON.stringify({
    ok: true,
    reward,
    balance: updatedUser.balance,
    todayEarnings: updatedUser.today_earnings,
  }));
}

async function distributeCommissions(db, userId, reward) {
  const rates = [0.10, 0.05, 0.02];

  for (let level = 1; level <= 3; level++) {
    const ref = await db.prepare(
      'SELECT inviter_id FROM referrals WHERE invitee_id = ? AND level = ?'
    ).bind(userId, level).first();

    if (!ref) break;

    const commission = Math.round(reward * rates[level - 1] * 100) / 100;
    if (commission <= 0) continue;

    await db.prepare(
      'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ? WHERE id = ?'
    ).bind(commission, commission, ref.inviter_id).run();

    await addTransaction(db, {
      userId: ref.inviter_id,
      type: 'Referral',
      amount: commission,
      status: 'Completed',
      description: `L${level} commission from user #${userId}`,
    });
  }
}
