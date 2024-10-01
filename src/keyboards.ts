import { Markup } from "telegraf";
import { tokens } from "./constants/tokens";

export const mainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Create Wallet', 'create_wallet')],
  [Markup.button.callback('Import Wallet', 'import_wallet')],
  [Markup.button.callback('Check Balance', 'check_balance')],
  [Markup.button.callback('Transfer Asset', 'transfer_asset')],
  [Markup.button.callback('Migrate Position', 'migrate_position')],
  [Markup.button.callback('Exit', 'exit')]
]);

export const backToMainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("Back to Main Menu", "main_menu")],
]);

export const checkBalanceKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("Check My Wallet Balance", "check_my_balance")],
  [Markup.button.callback("Check Other Address", "check_other_balance")],
  [Markup.button.callback("Back to Main Menu", "main_menu")],
]);

export const createOrImportWalletKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("Create New Wallet", "create_wallet")],
  [Markup.button.callback("Import Existing Wallet", "import_wallet")],
  [Markup.button.callback("Back to Main Menu", "main_menu")],
]);

export const transferAssetKeyboard = Markup.inlineKeyboard(
  Object.keys(tokens).map((ticker) => [
    Markup.button.callback(ticker, `transfer_${ticker}`),
  ])
);

export const confirmTransferKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("Confirm", "confirm_transfer")],
  [Markup.button.callback("Cancel", "cancel_transfer")],
]);
