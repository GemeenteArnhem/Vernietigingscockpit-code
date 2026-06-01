import { ContentPanelSection } from "../../../components/ContentPanel";
import type { TaskExecutionComment } from "../../../shared/types/taskExecution";

type Props = {
  comments: TaskExecutionComment[];
  title?: string;
  description?: string;
};

function CommentCard({
  comment,
}: {
  comment: TaskExecutionComment;
}) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50/80 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{comment.author}</div>
          <div className="text-xs text-slate-500">{comment.role}</div>
        </div>
        <div className="text-xs text-slate-400">{comment.timestamp}</div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{comment.message}</p>
    </div>
  );
}

export default function RecordCommentsSection({
  comments,
  title = "Opmerkingen",
  description = "Laatste notities binnen deze beoordeling.",
}: Props) {
  return (
    <ContentPanelSection
      title={title}
      description={description}
    >
      <div className="space-y-2">
        {comments.map((comment) => (
          <CommentCard
            key={`${comment.author}-${comment.timestamp}`}
            comment={comment}
          />
        ))}
      </div>
    </ContentPanelSection>
  );
}
