import * as React from "react";
import { SyncLoader } from "react-spinners";

export default function Spinner() {
  return (
    <div className="flex items-center justify-center mt-20">
      <SyncLoader color="#1c1917" />
    </div>
  );
}
