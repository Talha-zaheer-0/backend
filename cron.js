const cron = require('node-cron');
const Order = require('./models/Order');

// Schedule task to run daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const deletedOrders = await Order.deleteMany({
      status: 'Delivered',
      deliveredAt: { $lte: oneMonthAgo }
    });

    console.log(`Deleted ${deletedOrders.deletedCount} orders older than one month`);
  } catch (error) {
    console.error('❌ Auto Delete Orders Error:', error.message, error.stack);
  }
});

console.log('✅ Scheduled task for auto-deleting delivered orders initialized');