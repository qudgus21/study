import { toast } from "sonner";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_MESSAGE = "데모 모드입니다. 직접 사용하려면 README를 참고해주세요.";

/** Returns true (and shows toast) if demo mode is active. Use as early return guard. */
export function blockIfDemo(): boolean {
  if (DEMO_MODE) {
    toast.info(DEMO_MESSAGE, {
      action: {
        label: "README",
        onClick: () => window.open("https://github.com/qudgus21/study", "_blank"),
      },
    });
    return true;
  }
  return false;
}
