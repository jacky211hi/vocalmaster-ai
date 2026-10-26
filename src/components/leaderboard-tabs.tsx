"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LeaderboardTabs({
  personal,
  global,
}: {
  personal: React.ReactNode;
  global: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="personal">
      <TabsList>
        <TabsTrigger value="personal">Personal Best</TabsTrigger>
        <TabsTrigger value="global">Global / Friends</TabsTrigger>
      </TabsList>
      <TabsContent value="personal">{personal}</TabsContent>
      <TabsContent value="global">
        <p className="mb-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
          目前顯示全球榜。朋友排行榜（Friends）會喺之後版本加入。
        </p>
        {global}
      </TabsContent>
    </Tabs>
  );
}
