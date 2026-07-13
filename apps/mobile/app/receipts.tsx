import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
  SectionList,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest } from "../src/lib/api";
import { getToken } from "../src/lib/auth";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";
import { AuthenticatedImage } from "../src/components/AuthenticatedImage";

interface ReceiptItem {
  id: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  verificationStatus: string;
  createdAt: string;
  displayName: string;
  galleryLabel: string;
  expense: {
    amount: number;
    description: string | null;
    status: string | null;
    projectNumber: string | null;
  } | null;
  fielder: { id: string; name: string } | null;
}

export default function ReceiptGalleryScreen() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ReceiptItem | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await apiRequest<ReceiptItem[]>("/finance/receipts/mine", { token });
      setReceipts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sections = useMemo(() => {
    const map = new Map<string, ReceiptItem[]>();
    for (const item of receipts) {
      const key = item.fielder?.name ?? "My receipts";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [receipts]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No receipts uploaded yet.</Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionMeta}>{section.data.length} receipt(s)</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.tile} onPress={() => setSelected(item)}>
            <AuthenticatedImage
              fileKey={item.storedFileName}
              mimeType={item.mimeType}
              style={styles.thumbnail}
            />
            <Text style={styles.amount}>
              ${Number(item.expense?.amount ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              {item.displayName}
            </Text>
            <Text style={styles.label} numberOfLines={2}>
              {item.galleryLabel}
            </Text>
            <Text style={styles.status}>{item.verificationStatus}</Text>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <View style={styles.modalContent}>
            {selected && (
              <>
                <AuthenticatedImage
                  fileKey={selected.storedFileName}
                  mimeType={selected.mimeType}
                  style={styles.fullImage}
                />
                <Text style={styles.modalTitle}>{selected.displayName}</Text>
                <Text style={styles.modalSubtitle}>{selected.galleryLabel}</Text>
                <Text style={styles.modalMeta}>
                  {new Date(selected.createdAt).toLocaleDateString()} · {selected.verificationStatus}
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 12, paddingBottom: 40 },
  sectionHeader: { marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 17 },
  sectionMeta: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  empty: { color: colors.mutedForeground, textAlign: "center", marginTop: 40 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnail: { width: "100%", height: 160, borderRadius: 8 },
  amount: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 16, marginTop: 8 },
  meta: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 12, marginTop: 4, lineHeight: 16 },
  label: { color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  status: { color: colors.mutedForeground, fontSize: 11, marginTop: 4, textTransform: "capitalize" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: { alignItems: "center" },
  fullImage: { width: "100%", height: 360, borderRadius: 12 },
  modalTitle: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 15,
    marginTop: 16,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
  modalMeta: { color: colors.mutedForeground, fontSize: 13, marginTop: 6 },
});
