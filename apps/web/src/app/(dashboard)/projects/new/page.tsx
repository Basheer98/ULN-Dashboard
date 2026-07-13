import { Suspense } from "react";
import NewProjectPage from "./new-project-form";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
      <NewProjectPage />
    </Suspense>
  );
}
