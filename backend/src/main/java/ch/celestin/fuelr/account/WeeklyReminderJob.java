package ch.celestin.fuelr.account;

import ch.celestin.fuelr.mail.MailService;
import ch.celestin.fuelr.plan.PlanDtos;
import ch.celestin.fuelr.plan.PlanService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * The one email somebody may ask for, and the only one that is not
 * transactional.
 *
 * Off by default, or it is spam. Sent at the hour the person chose, in
 * Zurich time, and its content is decided at the moment of sending, not at
 * the moment of setting: a week filled since Tuesday does not get "your week
 * is empty" on Sunday. When there is nothing worth saying — the week is
 * planned and the list is done — nothing is sent, because a reminder that
 * says the same thing every week is one that gets filtered.
 */
@Component
public class WeeklyReminderJob {

    private static final Logger log = LoggerFactory.getLogger(WeeklyReminderJob.class);
    static final ZoneId ZONE = ZoneId.of("Europe/Zurich");

    private final UserRepository users;
    private final PlanService plan;
    private final MailService mail;
    private final String siteUrl;

    public WeeklyReminderJob(UserRepository users, PlanService plan, MailService mail,
                             @Value("${app.site-url}") String siteUrl) {
        this.users = users;
        this.plan = plan;
        this.mail = mail;
        this.siteUrl = siteUrl;
    }

    /** Every hour, on the hour: who asked for this hour of this day. */
    @Scheduled(cron = "0 0 * * * *", zone = "Europe/Zurich")
    public void tick() {
        ZonedDateTime now = ZonedDateTime.now(ZONE);
        sendFor(now);
    }

    /** The work, callable with a chosen instant — which is how a test drives it. */
    public int sendFor(ZonedDateTime when) {
        short day = (short) when.getDayOfWeek().getValue();
        short hour = (short) when.getHour();
        List<User> due = users.findByReminderDayAndReminderHour(day, hour);
        int sent = 0;
        for (User user : due) {
            String body = bodyFor(user, when.toLocalDate());
            if (body == null) {
                continue;
            }
            String locale = user.getLocale() == null ? "fr" : user.getLocale();
            mail.send(user.getEmail(), "Fuelr — ta semaine", body + """

                    —
                    Tu reçois ce rappel parce que tu l'as demandé. Pour l'arrêter, un clic :
                    %s
                    """.formatted(siteUrl + "/" + locale + "/unsubscribe?token=" + user.getReminderToken()));
            sent++;
        }
        if (sent > 0) {
            log.info("Weekly reminder sent to {} account(s)", sent);
        }
        return sent;
    }

    /** Decided now, from what the week actually holds. Null when there is nothing to say. */
    String bodyFor(User user, LocalDate today) {
        // The week that is coming: from tomorrow, the reminder looks ahead.
        PlanDtos.WeekView week = plan.week(user.getId(), today.plusDays(1));
        if (week.meals().isEmpty()) {
            return """
                    Bonjour,

                    Ta semaine qui vient est encore vide. Cinq minutes pour la remplir,
                    et la liste de courses s'écrit toute seule :
                    %s
                    """.formatted(siteUrl + "/" + (user.getLocale() == null ? "fr" : user.getLocale()) + "/app");
        }
        int planned = week.meals().size();
        return """
                Bonjour,

                Ta semaine qui vient a déjà %d repas. Ta liste de courses est prête :
                %s
                """.formatted(planned, siteUrl + "/" + (user.getLocale() == null ? "fr" : user.getLocale()) + "/app");
    }
}
