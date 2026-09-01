package ch.celestin.fuelr.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final String from;

    public MailService(JavaMailSender sender, @Value("${app.mail.from}") String from) {
        this.sender = sender;
        this.from = from;
    }

    /**
     * Hands the message to the SMTP relay off the request thread, and never
     * lets a mail failure become the caller's failure.
     *
     * Both properties serve the same purpose. The password-reset endpoint must
     * answer identically whether or not the address exists — and "identically"
     * includes how long it takes. Sending inline would make the response
     * noticeably slower exactly when the address is real, which is the leak the
     * endpoint exists to avoid; a bounced send turning into a 500 would say the
     * same thing more loudly. Failures are logged for the operator instead.
     */
    @Async("mailExecutor")
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        try {
            sender.send(message);
        } catch (MailException e) {
            log.error("Could not send \"{}\". Check the SMTP settings and that {} "
                    + "is on a domain verified with the provider.", subject, from, e);
        }
    }
}
