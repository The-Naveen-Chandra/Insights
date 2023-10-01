import { fetchUserPosts } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import InsightCard from "../cards/InsightCard";
import { fetchCommunityPosts } from "@/lib/actions/community.actions";

interface Props {
  currentUserId: string;
  accountId: string;
  accountType: string;
}

const InsightsTab = async ({
  currentUserId,
  accountId,
  accountType,
}: Props) => {
  let result: any;

  if (accountType === "Community") {
    result = await fetchCommunityPosts(accountId);
  } else {
    result = await fetchUserPosts(accountId);
  }

  if (!result) redirect("/");

  return (
    <section className="mt-9 flex flex-col gap-10">
      {result.insights.map((insight: any) => (
        <InsightCard
          key={insight._id}
          id={insight._id}
          currentUserId={currentUserId}
          parentId={insight.parentId}
          content={insight.text}
          author={
            accountType === "User"
              ? {
                  name: result.name,
                  image: result.image,
                  id: result.id,
                }
              : {
                  name: insight.author.name,
                  image: insight.author.image,
                  id: insight.author.id,
                }
          } // todo
          community={insight.community} // todo
          createdAt={insight.createdAt}
          comments={insight.children}
        />
      ))}
    </section>
  );
};

export default InsightsTab;
