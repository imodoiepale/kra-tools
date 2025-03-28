// // @ts-nocheck
// import { v } from "convex/values";
// import { action, query, mutation } from "./_generated/server";

// // Add a new user
// export const addUser = mutation({
//   args: {
//     name: v.string(),
//     idNumber: v.string(),
//     age: v.string(),
//     location: v.string(),
//   },
//   handler: async (ctx, args) => {
//     console.log('Server: Received user data:', args);
    
//     const userId = await ctx.db.insert("users", {
//       ...args,
//       createdAt: Date.now(),
//     });
    
//     console.log('Server: Successfully created user with ID:', userId);
    
//     // Fetch the created user to verify
//     const user = await ctx.db.get(userId);
//     console.log('Server: Verified user data:', user);
    
//     return userId;
//   },
// });

// // Get all users
// export const getUsers = query({
//   handler: async (ctx) => {
//     const users = await ctx.db.query("users").collect();
//     console.log('Server: Retrieved all users:', users);
//     return users;
//   },
// });

// // Get a specific user by ID
// export const getUserById = query({
//   args: { id: v.id("users") },
//   handler: async (ctx, args) => {
//     return await ctx.db.get(args.id);
//   },
// });
