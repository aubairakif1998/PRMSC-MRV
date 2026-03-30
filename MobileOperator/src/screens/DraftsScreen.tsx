import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DraftsListLoading } from "./screenSkeletons";
import { Text } from "../components/ui/text";
import { deleteDraft, getDrafts, type DraftRecord } from "../offline/drafts";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Drafts">;

type DraftItem = DraftRecord & { section: "water" | "solar" };

const LIST_CONTENT_STYLE = { paddingBottom: 30, gap: 10 } as const;

export function DraftsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [water, solar] = await Promise.all([getDrafts("water"), getDrafts("solar")]);
      const merged: DraftItem[] = [
        ...water.map((d) => ({ ...d, section: "water" as const })),
        ...solar.map((d) => ({ ...d, section: "solar" as const })),
      ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setDrafts(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = (item: DraftItem) => {
    Alert.alert("Delete draft", "Are you sure you want to delete this draft?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteDraft(item.section, item.id).then(load).catch(() => {});
        },
      },
    ]);
  };

  if (loading) {
    return <DraftsListLoading />;
  }

  return (
    <View className="flex-1 bg-muted/30 p-4">
      <FlatList
        data={drafts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={LIST_CONTENT_STYLE}
        ListEmptyComponent={
          <Text className="text-muted-foreground mt-10 px-4 text-center">
            No drafts yet. Save drafts from Water/Solar log screens.
          </Text>
        }
        renderItem={({ item }) => (
          <Card className="py-3">
            <CardHeader className="pb-2">
              <View className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {item.section === "water" ? "Water Draft" : "Solar Draft"}
                </CardTitle>
                <Badge variant="outline">
                  {item.section === "water" ? "Water" : "Solar"}
                </Badge>
              </View>
              <Text className="text-muted-foreground text-xs">
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </CardHeader>
            <CardContent className="flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() =>
                  navigation.navigate(item.section === "water" ? "WaterLog" : "SolarLog", {
                    draftId: item.id,
                  })
                }
              >
                Edit Draft
              </Button>
              <Button variant="destructive" onPress={() => onDelete(item)}>
                Delete
              </Button>
            </CardContent>
          </Card>
        )}
      />
    </View>
  );
}
