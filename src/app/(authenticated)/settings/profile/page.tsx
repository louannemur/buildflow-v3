import type { Metadata } from "next";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile Settings | BuildFlow",
};

export default function ProfileSettingsPage() {
  return <ProfileForm />;
}
