package ch.celestin.fuelr.account;

import ch.celestin.fuelr.auth.OneTimeToken;
import ch.celestin.fuelr.log.MealLogEntry;
import ch.celestin.fuelr.log.MealLogRepository;
import ch.celestin.fuelr.mail.MailService;
import ch.celestin.fuelr.media.MediaStorage;
import ch.celestin.fuelr.plan.HouseholdRepository;
import ch.celestin.fuelr.plan.PlannedMeal;
import ch.celestin.fuelr.plan.PlannedMealRepository;
import ch.celestin.fuelr.preferences.DietaryPreferencesRepository;
import ch.celestin.fuelr.profile.ProfileRepository;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeController;
import ch.celestin.fuelr.recipe.RecipeService;
import ch.celestin.fuelr.shopping.ShoppingItemRepository;
import ch.celestin.fuelr.shopping.ShoppingListRepository;
import ch.celestin.fuelr.weight.WeightEntryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Everything Fuelr holds about one person, in one archive.
 *
 * Built in the background — a library of two hundred recipes with photos is
 * not something a request should wait for — and fetched once, through a link
 * mailed to the account's address, within a day. After that the file is gone
 * whether it was taken or not: an archive that lingers on disk is a leak
 * waiting for a reason.
 *
 * **What is mine, and what is the household's.** The planning I see contains
 * meals other people put there; the export contains the ones *I* put there
 * (`planned_meals.created_by`), and the shopping lists of the household I
 * own — never the shared plan of a household I am only a member of. What is
 * not in it says so in the README: the `ai_usage` rows, which are the
 * operator's, and anything belonging to somebody else.
 */
@Service
public class DataExportService {

    private static final Logger log = LoggerFactory.getLogger(DataExportService.class);
    static final Duration LIFETIME = Duration.ofHours(24);

    private final DataExportRepository exports;
    private final UserRepository users;
    private final RecipeService recipes;
    private final PlannedMealRepository meals;
    private final HouseholdRepository households;
    private final ShoppingListRepository lists;
    private final ShoppingItemRepository items;
    private final MealLogRepository journal;
    private final ProfileRepository profiles;
    private final WeightEntryRepository weights;
    private final DietaryPreferencesRepository preferences;
    private final MediaStorage media;
    private final MailService mail;
    private final ObjectMapper json;
    private final Path dir;
    private final String siteUrl;

    public DataExportService(DataExportRepository exports, UserRepository users,
                             RecipeService recipes, PlannedMealRepository meals,
                             HouseholdRepository households, ShoppingListRepository lists,
                             ShoppingItemRepository items, MealLogRepository journal,
                             ProfileRepository profiles, WeightEntryRepository weights,
                             DietaryPreferencesRepository preferences, MediaStorage media,
                             MailService mail, ObjectMapper json,
                             @Value("${app.media.dir}") String mediaDir,
                             @Value("${app.site-url}") String siteUrl) {
        this.exports = exports;
        this.users = users;
        this.recipes = recipes;
        this.meals = meals;
        this.households = households;
        this.lists = lists;
        this.items = items;
        this.journal = journal;
        this.profiles = profiles;
        this.weights = weights;
        this.preferences = preferences;
        this.media = media;
        this.mail = mail;
        this.json = json;
        this.dir = Path.of(mediaDir, "exports");
        this.siteUrl = siteUrl;
    }

    /** Records the request and answers at once; the work happens in `build`. */
    @Transactional
    public String request(Long userId) {
        String token = OneTimeToken.mint();
        exports.save(new DataExport(userId, OneTimeToken.hash(token), Instant.now().plus(LIFETIME)));
        return token;
    }

    /**
     * Builds the archive and mails the link. `@Async`, and in its own
     * transaction: the request that asked for it has long since answered.
     */
    @Async
    public void build(Long userId, String token, String locale) {
        buildNow(userId, token, locale);
    }

    /** The work itself, callable in the foreground — which is how a test reads it. */
    @Transactional
    public void buildNow(Long userId, String token, String locale) {
        DataExport export = exports.findByTokenHash(OneTimeToken.hash(token)).orElse(null);
        User user = users.findById(userId).orElse(null);
        if (export == null || user == null) {
            return;
        }
        try {
            Files.createDirectories(dir);
            Path file = dir.resolve("fuelr-" + userId + "-" + OneTimeToken.mint().substring(0, 12) + ".zip");
            try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(file))) {
                write(zip, "README.md", readme().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                List<Recipe> mine = recipes.list(userId);
                write(zip, "recipes.json", json.writerWithDefaultPrettyPrinter().writeValueAsBytes(
                        mine.stream().map(RecipeController::toView).toList()));
                write(zip, "plan.json", json.writerWithDefaultPrettyPrinter().writeValueAsBytes(
                        meals.findByCreatedByOrderByDateAsc(userId).stream().map(this::meal).toList()));
                write(zip, "shopping.json", json.writerWithDefaultPrettyPrinter().writeValueAsBytes(shopping(userId)));
                write(zip, "journal.json", json.writerWithDefaultPrettyPrinter().writeValueAsBytes(
                        journal.findByUserIdOrderByDateAsc(userId).stream().map(this::entry).toList()));
                write(zip, "profile.json", json.writerWithDefaultPrettyPrinter().writeValueAsBytes(profile(user)));
                for (Recipe recipe : mine) {
                    if (recipe.getPhotoPath() != null) {
                        Path photo = media.resolve(recipe.getPhotoPath());
                        if (Files.exists(photo)) {
                            String ext = recipe.getPhotoPath().contains(".")
                                    ? recipe.getPhotoPath().substring(recipe.getPhotoPath().lastIndexOf('.')) : "";
                            write(zip, "media/" + recipe.getId() + ext, Files.readAllBytes(photo));
                        }
                    }
                }
            }
            export.ready(file.toString());
            exports.save(export);
            mail.send(user.getEmail(), "Ton export Fuelr est prêt", """
                    Bonjour,

                    L'archive de tout ce que Fuelr sait de toi est prête. Elle se
                    télécharge une seule fois, avec ce lien, pendant 24 heures :
                    %s

                    Après ça, elle est effacée de nos disques — qu'elle ait été prise ou non.
                    """.formatted(siteUrl + "/" + locale + "/export?token=" + token));
        } catch (IOException e) {
            log.warn("Export for account {} could not be built: {}", userId, e.toString());
        }
    }

    /** The one download. The file goes with it, so a link is a link once. */
    @Transactional
    public Optional<Path> take(String token) {
        Optional<DataExport> found = exports.findByTokenHash(OneTimeToken.hash(token));
        if (found.isEmpty() || !found.get().isUsable()) {
            return Optional.empty();
        }
        DataExport export = found.get();
        export.downloaded();
        exports.save(export);
        return Optional.of(Path.of(export.getPath()));
    }

    /** Called after the bytes have been streamed. */
    public void discard(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException e) {
            log.warn("Export file {} could not be removed: {}", file, e.toString());
        }
    }

    /** A deleted account takes its pending archives with it, on disk too. */
    @Transactional
    public void cancelFor(Long userId) {
        for (DataExport export : exports.findByUserId(userId)) {
            if (export.getPath() != null) {
                discard(Path.of(export.getPath()));
            }
            exports.delete(export);
        }
    }

    /** What nobody downloaded within the day is removed, file and row. */
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void sweep() {
        for (DataExport export : exports.findByExpiresAtBefore(Instant.now())) {
            if (export.getPath() != null) {
                discard(Path.of(export.getPath()));
            }
            exports.delete(export);
        }
    }

    // --- the shapes -------------------------------------------------------------

    private Map<String, Object> meal(PlannedMeal meal) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", meal.getDate().toString());
        out.put("slot", meal.getSlot().name());
        out.put("recipeId", meal.getRecipeId());
        out.put("servings", meal.getServings());
        out.put("cookedAt", meal.getCookedAt());
        out.put("inShopping", meal.isInShopping());
        return out;
    }

    private List<Map<String, Object>> shopping(Long userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        households.findByOwnerUserId(userId).ifPresent(household -> {
            for (var list : lists.findByHouseholdIdOrderByWeekStartAsc(household.getId())) {
                Map<String, Object> week = new LinkedHashMap<>();
                week.put("weekStart", list.getWeekStart().toString());
                week.put("items", items.findByListIdOrderByIdAsc(list.getId()).stream().map(item -> {
                    Map<String, Object> line = new LinkedHashMap<>();
                    line.put("name", item.getName());
                    line.put("quantity", item.getQuantity());
                    line.put("unit", item.getUnit());
                    line.put("checked", item.isChecked());
                    line.put("source", item.getSource() == null ? null : item.getSource().name());
                    return line;
                }).toList());
                out.add(week);
            }
        });
        return out;
    }

    private Map<String, Object> entry(MealLogEntry entry) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", entry.getDate().toString());
        out.put("slot", entry.getSlot());
        out.put("title", entry.getTitle());
        out.put("servings", entry.getServings());
        out.put("kcal", entry.getKcal());
        out.put("proteinG", entry.getProteinG());
        out.put("carbsG", entry.getCarbsG());
        out.put("fatG", entry.getFatG());
        out.put("estimated", entry.isEstimated());
        out.put("source", entry.getSource() == null ? null : entry.getSource().name());
        return out;
    }

    private Map<String, Object> profile(User user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("email", user.getEmail());
        out.put("name", user.getName());
        out.put("locale", user.getLocale());
        out.put("createdAt", user.getCreatedAt());
        profiles.findByUserId(user.getId()).ifPresent(p -> out.put("profile", p.toInput()));
        out.put("weights", weights.findByUserIdAndWeighedOnBetweenOrderByWeighedOnAsc(
                user.getId(), java.time.LocalDate.of(1900, 1, 1), java.time.LocalDate.of(2999, 12, 31))
                .stream().map(w -> Map.of("weighedOn", w.getWeighedOn().toString(), "weightKg", w.getWeightKg()))
                .toList());
        preferences.findById(user.getId()).ifPresent(p -> {
            Map<String, Object> prefs = new LinkedHashMap<>();
            prefs.put("diet", p.getDiet().name());
            prefs.put("allergens", p.getAllergens().stream().map(Enum::name).toList());
            prefs.put("dislikes", p.getDislikes());
            out.put("preferences", prefs);
        });
        return out;
    }

    private static String readme() {
        return """
                # Votre export Fuelr

                Tout ce que Fuelr sait de vous, au moment où l'archive a été faite.

                - `recipes.json` — vos recettes, au format de l'export de la bibliothèque.
                - `media/` — leurs photos, nommées par l'identifiant de la recette.
                - `plan.json` — les repas que **vous** avez posés sur le planning.
                - `shopping.json` — les listes de courses du foyer dont vous êtes propriétaire.
                - `journal.json` — votre journal, avec les chiffres tels qu'ils étaient au moment de noter.
                - `profile.json` — votre compte, votre profil, vos pesées, vos préférences alimentaires.

                Ce qui n'y est pas, volontairement : les repas posés par d'autres membres d'un foyer
                partagé, les listes d'un foyer dont vous n'êtes que membre, et les lignes de coût des
                fonctions IA, qui appartiennent à l'exploitant du service.
                """;
    }

    private static void write(ZipOutputStream zip, String name, byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(bytes);
        zip.closeEntry();
    }

    /** Streams a file into a response body. */
    public static void copy(Path file, OutputStream out) throws IOException {
        Files.copy(file, out);
    }
}
