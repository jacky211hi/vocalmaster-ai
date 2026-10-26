"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LeaderboardTabs({
  personal,
  global,
  friends,
}: {
  personal: React.ReactNode;
  global: React.ReactNode;
  friends: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="personal">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="personal">Personal Best</TabsTrigger>
        <TabsTrigger value="friends">Friends</TabsTrigger>
        <TabsTrigger value="global">Global</TabsTrigger>
      </TabsList>
      <TabsContent value="personal">{personal}</TabsContent>
      <TabsContent value="friends">{friends}</TabsContent>
      <TabsContent value="global">{global}</TabsContent>
    </Tabs>
  );
}
