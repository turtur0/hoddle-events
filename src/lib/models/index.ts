// ============================================
// EVENT MODEL
// ============================================
export { default as Event } from './Event';
export type { IEvent, SerialisedEvent } from './Event';

// ============================================
// USER MODEL
// ============================================
export { default as User } from './User';
export type { IUser } from './User';

// ============================================
// NOTIFICATION MODEL
// ============================================
export { default as Notification } from './Notification';
export type { INotification } from './Notification';

// ============================================
// USER FAVOURITE MODEL
// ============================================
export { default as UserFavourite } from './UserFavourite';
export type { IUserFavourite } from './UserFavourite';

// ============================================
// USER INTERACTION MODEL
// ============================================
export { default as UserInteraction } from './UserInteraction';
export type { IUserInteraction } from './UserInteraction';

// ============================================
// DEFAULT EXPORT (All Models)
// ============================================
import Event from './Event';
import User from './User';
import Notification from './Notification';
import UserFavourite from './UserFavourite';
import UserInteraction from './UserInteraction';

export default {
    Event,
    User,
    Notification,
    UserFavourite,
    UserInteraction,
} as const;