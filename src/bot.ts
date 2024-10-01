import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { handleCreateWallet } from './commands/createWallet';
import { handleImportWallet } from './commands/importWallet';
import { handleCheckBalance } from './commands/checkBalance';
import {
  handleTransferAsset,
  handleTransferTicker,
  handleTransferRecipient,
  handleTransferAmount,
  handleConfirmTransfer,
  handleCancelTransfer,
  TransferState,
  transferStates
} from './commands/transferAsset';
import {
  handleMigratePosition,
  MigrationState,
  migrationStates
} from './commands/migratePosition';
import {
  mainMenuKeyboard,
  backToMainMenuKeyboard,
  checkBalanceKeyboard,
  createOrImportWalletKeyboard
} from './keyboards';
import { getUserWallet, saveUserWallet } from './storage';

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in the environment variables');
}

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be set and be a 64-character hexadecimal string');
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// State to keep track of users who are in the process of importing a wallet
const usersImportingWallet = new Set<number>();

bot.command('start', (ctx) => {
  ctx.reply('Welcome to the Wallet Bot! What would you like to do?', mainMenuKeyboard);
});

bot.action('main_menu', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText('What would you like to do?', mainMenuKeyboard);
});

bot.action('create_wallet', async (ctx) => {
  ctx.answerCbQuery();
  await handleCreateWallet(ctx);
  ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
});

bot.action('import_wallet', (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from?.id;
  if (userId) {
    usersImportingWallet.add(userId);
  }
  ctx.editMessageText('Please send me your private key. It should start with "0x" and be 66 characters long. WARNING: Never share your private key with anyone else!');
});

bot.action('check_balance', (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from?.id;
  if (userId && getUserWallet(userId)) {
    ctx.editMessageText('What balance would you like to check?', checkBalanceKeyboard);
  } else {
    ctx.editMessageText('You need to create or import a wallet first:', createOrImportWalletKeyboard);
  }
});

bot.action('check_my_balance', async (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from?.id;
  if (userId) {
    const userWallet = getUserWallet(userId);
    if (userWallet) {
      await handleCheckBalance(ctx, userWallet.address);
      ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
    } else {
      ctx.editMessageText('You need to create or import a wallet first:', createOrImportWalletKeyboard);
    }
  }
});

bot.action('check_other_balance', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText('Please send me the wallet address you want to check.');
});

bot.action('transfer_asset', handleTransferAsset);

bot.action(/^transfer_(.+)$/, handleTransferTicker);

bot.action('confirm_transfer', handleConfirmTransfer);

bot.action('cancel_transfer', handleCancelTransfer);

bot.action('migrate_position', (ctx) => {
  ctx.answerCbQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const userWallet = getUserWallet(userId);
  if (!userWallet) {
    ctx.editMessageText('You need to create or import a wallet first.', createOrImportWalletKeyboard);
    return;
  }

  migrationStates.set(userId, {});
  ctx.editMessageText('Let\'s migrate your position. First, choose the source network:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Polygon', 'migrate_from_polygon')],
      [Markup.button.callback('Cancel', 'cancel_migration')]
    ]));
});

bot.action('migrate_from_polygon', (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !migrationStates.has(userId)) return;

  const state = migrationStates.get(userId)!;
  state.fromNetwork = 'polygon';
  migrationStates.set(userId, state);

  ctx.editMessageText('Great! Now choose the destination network:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Base', 'migrate_to_base')],
      [Markup.button.callback('Cancel', 'cancel_migration')]
    ]));
});

bot.action('migrate_to_base', (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !migrationStates.has(userId)) return;

  const state = migrationStates.get(userId)!;
  state.toNetwork = 'base';
  migrationStates.set(userId, state);

  ctx.editMessageText('Which token would you like to migrate? (e.g., USDC)');
});

bot.action('cancel_migration', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    migrationStates.delete(userId);
  }
  ctx.editMessageText('Migration process cancelled.', mainMenuKeyboard);
});

bot.action('exit', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText('Thank you for using the Wallet Bot. Goodbye!');
});

// Handle text messages for various scenarios
bot.on('text', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const userWallet = getUserWallet(userId);
  const messageText = ctx.message.text;

  // Import wallet scenario
  if (usersImportingWallet.has(userId)) {
    await handleImportWallet(ctx, messageText);
    usersImportingWallet.delete(userId);
    ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
    return;
  }

  // Check other balance scenario
  if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message && ctx.message.reply_to_message.text === 'Please send me the wallet address you want to check.') {
    await handleCheckBalance(ctx, messageText);
    ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
    return;
  }

  // Transfer asset scenarios
  const transferState = transferStates.get(userId);
  if (transferState) {
    if (!transferState.recipient) {
      // Setting recipient
      await handleTransferRecipient(ctx);
      return;
    } else if (!transferState.amount) {
      // Setting amount
      await handleTransferAmount(ctx);
      return;
    }
  }

  // Migration process
  const migrationState = migrationStates.get(userId);
  if (migrationState) {
    if (!migrationState.token) {
      migrationState.token = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";// messageText.toUpperCase();
      migrationStates.set(userId, migrationState);
      ctx.reply('How much would you like to migrate?');
    } else if (!migrationState.amount) {
      migrationState.amount = messageText;
      migrationStates.set(userId, migrationState);


        console.log(migrationState)
      // All information collected, proceed with migration
      await handleMigratePosition(ctx, migrationState as MigrationState, userWallet);
    }
    return;
  }

  // If none of the above, show main menu
  ctx.reply('I didn\'t understand that. What would you like to do?', mainMenuKeyboard);
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  ctx.reply('An error occurred. Please try again later or contact support.');
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// import { Telegraf, Context } from 'telegraf';
// import dotenv from 'dotenv';
// import { handleCreateWallet } from './commands/createWallet';
// import { handleImportWallet } from './commands/importWallet';
// import { handleCheckBalance } from './commands/checkBalance';
// import {
//   handleTransferAsset,
//   handleTransferTicker,
//   handleTransferRecipient,
//   handleTransferAmount,
//   handleConfirmTransfer,
//   handleCancelTransfer,
//   TransferState,
//   transferStates
// } from './commands/transferAsset';
// import {
//   mainMenuKeyboard,
//   backToMainMenuKeyboard,
//   checkBalanceKeyboard,
//   createOrImportWalletKeyboard
// } from './keyboards';
// import { getUserWallet } from './storage';

// dotenv.config();

// if (!process.env.TELEGRAM_BOT_TOKEN) {
//   throw new Error('TELEGRAM_BOT_TOKEN is not set in the environment variables');
// }

// if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
//   throw new Error('ENCRYPTION_KEY must be set and be a 64-character hexadecimal string');
// }

// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// // State to keep track of users who are in the process of importing a wallet
// const usersImportingWallet = new Set<number>();

// bot.command('start', (ctx) => {
//   ctx.reply('Welcome to the Wallet Bot! What would you like to do?', mainMenuKeyboard);
// });

// bot.action('main_menu', (ctx) => {
//   ctx.answerCbQuery();
//   ctx.editMessageText('What would you like to do?', mainMenuKeyboard);
// });

// bot.action('create_wallet', async (ctx) => {
//   ctx.answerCbQuery();
//   await handleCreateWallet(ctx);
//   ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
// });

// bot.action('import_wallet', (ctx) => {
//   ctx.answerCbQuery();
//   const userId = ctx.from?.id;
//   if (userId) {
//     usersImportingWallet.add(userId);
//   }
//   ctx.reply('Please send me your private key. It should start with "0x" and be 66 characters long. WARNING: Never share your private key with anyone else!');
// });

// bot.action('check_balance', (ctx) => {
//   ctx.answerCbQuery();
//   const userId = ctx.from?.id;
//   if (userId && getUserWallet(userId)) {
//     ctx.editMessageText('What balance would you like to check?', checkBalanceKeyboard);
//   } else {
//     ctx.editMessageText('You need to create or import a wallet first:', createOrImportWalletKeyboard);
//   }
// });

// bot.action('check_my_balance', async (ctx) => {
//   ctx.answerCbQuery();
//   const userId = ctx.from?.id;
//   if (userId) {
//     const userWallet = getUserWallet(userId);
//     if (userWallet) {
//       await handleCheckBalance(ctx, userWallet.address);
//       ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
//     } else {
//       ctx.editMessageText('You need to create or import a wallet first:', createOrImportWalletKeyboard);
//     }
//   }
// });

// bot.action('check_other_balance', (ctx) => {
//   ctx.answerCbQuery();
//   ctx.reply('Please send me the wallet address you want to check.');
// });

// bot.action('transfer_asset', handleTransferAsset);

// bot.action(/^transfer_(.+)$/, async (ctx) => {
//   await handleTransferTicker(ctx);
//   if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
//     const ticker = ctx.callbackQuery.data.split('_')[1];
//     await ctx.reply(`You selected ${ticker}. Now, please enter the recipient's address:`);
//   }
// });

// bot.action('confirm_transfer', handleConfirmTransfer);

// bot.action('cancel_transfer', handleCancelTransfer);

// bot.action('exit', (ctx) => {
//   ctx.answerCbQuery();
//   ctx.editMessageText('Thank you for using the Wallet Bot. Goodbye!');
// });

// // Handle text messages for various scenarios
// bot.on('text', async (ctx) => {
//   const userId = ctx.from?.id;
//   if (!userId) return;

//   const userWallet = getUserWallet(userId);
//   const messageText = ctx.message.text;

//   // Import wallet scenario
//   if (usersImportingWallet.has(userId)) {
//     await handleImportWallet(ctx, messageText);
//     usersImportingWallet.delete(userId);
//     ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
//     return;
//   }

//   // Check other balance scenario
//   if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message && ctx.message.reply_to_message.text === 'Please send me the wallet address you want to check.') {
//     await handleCheckBalance(ctx, messageText);
//     ctx.reply('What would you like to do next?', backToMainMenuKeyboard);
//     return;
//   }

//   // Transfer asset scenarios
//   const transferState = transferStates.get(userId);
//   if (transferState) {
//     if (!transferState.recipient) {
//       // Setting recipient
//       await handleTransferRecipient(ctx);
//       return;
//     } else if (!transferState.amount) {
//       // Setting amount
//       await handleTransferAmount(ctx);
//       return;
//     }
//   }

//   // If none of the above, show main menu
//   ctx.reply('I didn\'t understand that. What would you like to do?', mainMenuKeyboard);
// });

// // Error handling
// bot.catch((err, ctx) => {
//   console.error(`Error for ${ctx.updateType}`, err);
//   ctx.reply('An error occurred. Please try again later or contact support.');
// });

// bot.launch();

// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));
