import InsightCard from "@/components/cards/InsightCard";
import { fetchInsightById } from "@/lib/actions/insight.actions";
import { fetchUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const Page = async ({ params }: { params: { id: string } }) => {
  if (!params.id) return null;

  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const insight = await fetchInsightById(params.id);

  return (
    <section className="relative">
      <div>
        <InsightCard
          key={insight._id}
          id={insight._id}
          currentUserId={user?.id || ""}
          parentId={insight.parentId}
          content={insight.text}
          author={insight.author}
          community={insight.community}
          createdAt={insight.createdAt}
          comments={insight.children}
        />
      </div>
    </section>
  );
};

export default Page;
