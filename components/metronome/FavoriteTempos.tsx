import { StyleSheet, TouchableOpacity, View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { FavoriteTempo } from "@/utils/metronome/types";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";

interface FavoriteTemposProps {
  favorites: FavoriteTempo[];
  currentTempo: number;
  isFavorite: boolean;
  onSelect: (tempo: number) => void;
  onToggleFavorite: () => void;
  onRemove: (id: string) => void;
}

export default function FavoriteTempos({
  favorites,
  currentTempo,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onRemove,
}: FavoriteTemposProps) {
  const { t } = useTranslation("common");
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText style={styles.label}>{t("metronome.favorites")}</AppText>
        <TouchableOpacity style={styles.addButton} onPress={onToggleFavorite}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={20}
            color={isFavorite ? colors.primary : "#888"}
          />
          <AppText style={styles.addButtonText}>
            {isFavorite ? t("metronome.saved") : t("metronome.saveCurrent")}
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {favorites.length === 0 ? (
          <AppText style={styles.emptyText}>{t("metronome.noFavorites")}</AppText>
        ) : (
          favorites.map((fav) => (
            <TouchableOpacity
              key={fav.id}
              style={[
                styles.favoriteItem,
                fav.tempo === currentTempo && {
                  backgroundColor: colors.primaryLight,
                  borderWidth: 1,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => onSelect(fav.tempo)}
              onLongPress={() => onRemove(fav.id)}
            >
              <AppText
                style={[
                  styles.favoriteText,
                  fav.tempo === currentTempo && { color: colors.primary },
                ]}
              >
                {fav.tempo}
              </AppText>
              {fav.label && (
                <AppText style={styles.favoriteLabel}>{fav.label}</AppText>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: "#888",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  addButtonText: {
    fontSize: 12,
    color: "#888",
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#555",
    fontStyle: "italic",
  },
  favoriteItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#222",
    alignItems: "center",
  },
  favoriteText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  favoriteLabel: {
    fontSize: 10,
    color: "#888",
    marginTop: 2,
  },
});
