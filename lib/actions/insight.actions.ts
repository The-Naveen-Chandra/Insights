"use server";

import { revalidatePath } from "next/cache";

import { connectToDB } from "../mongoose";

import User from "../models/user.model";
import Community from "../models/community.model";
import Insight from "../models/insight.model";

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  connectToDB();

  // Calculate the number of posts to skip based on the page number and page size.
  const skipAmount = (pageNumber - 1) * pageSize;

  // Create a query to fetch the posts that have no parent (top-level insights) (a insight that is not a comment/reply).
  const postsQuery = Insight.find({ parentId: { $in: [null, undefined] } })
    .sort({ createdAt: "desc" })
    .skip(skipAmount)
    .limit(pageSize)
    .populate({
      path: "author",
      model: User,
    })
    .populate({
      path: "community",
      model: Community,
    })
    .populate({
      path: "children", // Populate the children field
      populate: {
        path: "author", // Populate the author field within children
        model: User,
        select: "_id name parentId image", // Select only _id and username fields of the author
      },
    });

  // Count the total number of top-level posts (insights) i.e., insights that are not comments.
  const totalPostsCount = await Insight.countDocuments({
    parentId: { $in: [null, undefined] },
  }); // Get the total count of posts

  const posts = await postsQuery.exec();

  const isNext = totalPostsCount > skipAmount + posts.length;

  return { posts, isNext };
}

interface Params {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

export async function createInsight({
  text,
  author,
  communityId,
  path,
}: Params) {
  try {
    connectToDB();

    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    const createdInsight = await Insight.create({
      text,
      author,
      community: communityIdObject, // Assign communityId if provided, or leave it null for personal account
    });

    // Update User model
    await User.findByIdAndUpdate(author, {
      $push: { insights: createdInsight._id },
    });

    if (communityIdObject) {
      // Update Community model
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { insights: createdInsight._id },
      });
    }

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to create Insight: ${error.message}`);
  }
}

async function fetchAllChildInsights(insightId: string): Promise<any[]> {
  const childInsights = await Insight.find({ parentId: insightId });

  const descendantInsights = [];
  for (const childInsight of childInsights) {
    const descendants = await fetchAllChildInsights(childInsight._id);
    descendantInsights.push(childInsight, ...descendants);
  }

  return descendantInsights;
}

export async function deleteInsight(id: string, path: string): Promise<void> {
  try {
    connectToDB();

    // Find the insight to be deleted (the main insight)
    const mainInsight = await Insight.findById(id).populate("author community");

    if (!mainInsight) {
      throw new Error("Insight not found");
    }

    // Fetch all child insights and their descendants recursively
    const descendantInsights = await fetchAllChildInsights(id);

    // Get all descendant insights IDs including the main insight ID and child insight IDs
    const descendantInsightIds = [
      id,
      ...descendantInsights.map((insight) => insight._id),
    ];

    // Extract the authorIds and communityIds to update User and Community models respectively
    const uniqueAuthorIds = new Set(
      [
        ...descendantInsights.map((insight) => insight.author?._id?.toString()), // Use optional chaining to handle possible undefined values
        mainInsight.author?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    const uniqueCommunityIds = new Set(
      [
        ...descendantInsights.map((insight) =>
          insight.community?._id?.toString()
        ), // Use optional chaining to handle possible undefined values
        mainInsight.community?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    // Recursively delete child insights and their descendants
    await Insight.deleteMany({ _id: { $in: descendantInsightIds } });

    // Update User model
    await User.updateMany(
      { _id: { $in: Array.from(uniqueAuthorIds) } },
      { $pull: { insights: { $in: descendantInsightIds } } }
    );

    // Update Community model
    await Community.updateMany(
      { _id: { $in: Array.from(uniqueCommunityIds) } },
      { $pull: { insights: { $in: descendantInsightIds } } }
    );

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to delete insight: ${error.message}`);
  }
}

export async function fetchInsightById(insightId: string) {
  connectToDB();

  try {
    const insight = await Insight.findById(insightId)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      }) // Populate the author field with _id and username
      .populate({
        path: "community",
        model: Community,
        select: "_id id name image",
      }) // Populate the community field with _id and name
      .populate({
        path: "children", // Populate the children field
        populate: [
          {
            path: "author", // Populate the author field within children
            model: User,
            select: "_id id name parentId image", // Select only _id and username fields of the author
          },
          {
            path: "children", // Populate the children field within children
            model: Insight, // The model of the nested children (assuming it's the same "Insight" model)
            populate: {
              path: "author", // Populate the author field within nested children
              model: User,
              select: "_id id name parentId image", // Select only _id and username fields of the author
            },
          },
        ],
      })
      .exec();

    return insight;
  } catch (err) {
    console.error("Error while fetching insight:", err);
    throw new Error("Unable to fetch insight");
  }
}

export async function addCommentToInsight(
  insightId: string,
  commentText: string,
  userId: string,
  path: string
) {
  connectToDB();

  try {
    // Find the original insight by its ID
    const originalInsight = await Insight.findById(insightId);

    if (!originalInsight) {
      throw new Error("Insight not found");
    }

    // Create the new comment insight
    const commentInsight = new Insight({
      text: commentText,
      author: userId,
      parentId: insightId, // Set the parentId to the original insight's ID
    });

    // Save the comment insight to the database
    const savedCommentInsight = await commentInsight.save();

    // Add the comment insight's ID to the original insight's children array
    originalInsight.children.push(savedCommentInsight._id);

    // Save the updated original insight to the database
    await originalInsight.save();

    revalidatePath(path);
  } catch (err) {
    console.error("Error while adding comment:", err);
    throw new Error("Unable to add comment");
  }
}
