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
