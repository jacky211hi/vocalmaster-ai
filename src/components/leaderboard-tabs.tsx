"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/locale-provider";

export function LeaderboardTabs({
  personal,
  global,
  friends,
}: {
  personal: React.ReactNode;
  global: React.ReactNode;
  friends: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="global">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="global">{t("leaderboard.tab.global")}</TabsTrigger>
        <TabsTrigger value="friends">{t("leaderboard.tab.friends")}</TabsTrigger>
        <TabsTrigger value="personal">
          {t("leaderboard.tab.personal")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="global">{global}</TabsContent>
      <TabsContent value="friends">{friends}</TabsContent>
      <TabsContent value="personal">{personal}</TabsContent>
    </Tabs>
  );
}
