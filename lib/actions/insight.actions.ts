"use server";

import { revalidatePath } from "next/cache";
import Insight from "../models/insight.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";

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

    const createdInsight = await Insight.create({
      text,
      author,
      community: null,
    });

    // Update user model
    await User.findByIdAndUpdate(author, {
      $push: { insights: createdInsight._id },
    });

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Error creating insight: ${error.message}`);
  }
}

export async function fetchPost(pageNumber = 1, pageSize = 20) {
  connectToDB();

  // Calculate the number of posts to skip
  const skipAmount = (pageNumber - 1) * pageSize;

  // Fetch the posts that have no parents (top-level insights...)
  const postsQuery = Insight.find({
    parentId: { $in: [null, undefined] },
  })
    .sort({ createdAt: "desc" })
    .skip(skipAmount)
    .limit(pageSize)
    .populate({ path: "author", model: User })
    .populate({
      path: "children",
      populate: {
        path: "author",
        model: User,
        select: "_id name parentId image",
      },
    });

  const totalPostsCount = await Insight.countDocuments({
    parentId: { $in: [null, undefined] },
  });

  const posts = await postsQuery.exec();

  const isNext = totalPostsCount > skipAmount + posts.length;

  return { posts, isNext };
}

export async function fetchInsightById(id: string) {
  connectToDB();

  try {
    // TODO: Populate Community
    const insight = await Insight.findById(id)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      })
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name parentId image",
          },
          {
            path: "children",
            model: Insight,
            populate: {
              path: "author",
              model: User,
              select: "_id id name parentId image",
            },
          },
        ],
      })
      .exec();

    return insight;
  } catch (error: any) {
    throw new Error(`Error fetching insight: ${error.message}`);
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
    // add comment to insight
    // Find the original insight by its ID
    const originalInsight = await Insight.findById(insightId);

    if (!originalInsight) {
      throw new Error("Insight not found");
    }

    // Create a new insight with the comment text
    const commentInsight = new Insight({
      text: commentText,
      author: userId,
      parentId: insightId,
    });

    // Save the new thread
    const savedCommentInsight = await commentInsight.save();

    // Update the original insight to include the new comment
    originalInsight.children.push(savedCommentInsight._id);

    // Save te original insight
    await originalInsight.save();

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Error adding comment to insight: ${error.message}`);
  }
}
