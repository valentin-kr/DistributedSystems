package de.htw.chatroomapi.service;

import de.htw.chatroomapi.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class MessageEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(MessageEventPublisher.class);

    private final ObjectProvider<KafkaTemplate<String, String>> kafkaTemplateProvider;
    private final boolean enabled;
    private final String topic;

    public MessageEventPublisher(
            ObjectProvider<KafkaTemplate<String, String>> kafkaTemplateProvider,
            @Value("${chatroom.kafka.enabled:false}") boolean enabled,
            @Value("${chatroom.kafka.message-topic:message-events}") String topic) {
        this.kafkaTemplateProvider = kafkaTemplateProvider;
        this.enabled = enabled;
        this.topic = topic;
    }

    public void publishMessageSent(Integer chatroomId, Message message) {
        if (!enabled) {
            return;
        }

        KafkaTemplate<String, String> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            log.warn("Kafka producer is enabled, but no KafkaTemplate is available");
            return;
        }

        String payload = """
                {"type":"message.sent","userId":%d,"chatroomId":%d,"messageId":%d,"timestamp":"%s"}"""
                .formatted(message.getAuthorId(), chatroomId, message.getId(), message.getTimestamp());

        try {
            kafkaTemplate.send(topic, String.valueOf(message.getAuthorId()), payload)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("Could not publish message event for message {}", message.getId(), ex);
                        }
                    });
        } catch (RuntimeException ex) {
            log.warn("Could not publish message event for message {}", message.getId(), ex);
        }
    }
}
