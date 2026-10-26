import Reactions from "@/components/ui/reactions";
import { Heart, PartyPopper, ThumbsUp } from "lucide-react";

const options = [
  { id: "like", label: "Like", icon: ThumbsUp },
  { id: "love", label: "Love", icon: Heart },
  { id: "party", label: "Celebrate", icon: PartyPopper },
];

export default function CommentReactionsDemo() {
  return (
    <div className="flex min-h-[300px] w-full items-center justify-center p-8">
      <Reactions
        options={options}
        defaultValue={[{ id: "like", count: 3, reacted: false }]}
        onValueChange={(_, change) => console.log(change)}
      />
    </div>
  );
}

