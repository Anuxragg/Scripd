export type ApiSuccess<TData, TMeta = Record<string, never>> = {
  data: TData;
  meta: TMeta;
};

export type CursorPageMeta = {
  next_cursor: string | null;
  has_more: boolean;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
};
