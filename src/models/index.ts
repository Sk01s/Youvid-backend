import { createUsersTable } from "../models/user.model";
import {
  createCategoriesTable,
  seedCategories,
} from "../models/category.model";
import { createChannelsTable } from "../models/channel.model";
import { createVideosTable } from "../models/video.model";
import { createVideoInteractionsTable } from "../models/videoInteraction.model";
import { createSubscriptionsTable } from "../models/subscription.model";
import { createCommentsTable } from "../models/comment.model";
import { createCommentInteractionsTable } from "../models/commentInteraction.model";
import { createVideoViewsTable } from "../models/videoView.model";
import { createSubscriptionHistoryTable } from "../models/subscriptionHistory.model";

export const initializeDatabase = async () => {
  // Create tables in dependency order
  await createUsersTable();
  await createCategoriesTable();
  await createChannelsTable();
  await createVideosTable();
  await createVideoInteractionsTable();
  await createSubscriptionsTable();
  await createCommentsTable();
  await createCommentInteractionsTable();
  await createVideoViewsTable();
  await createSubscriptionHistoryTable();

  // Seed default categories
  // await seedCategories();
};
