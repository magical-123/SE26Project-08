package com.infodigest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class InfoDigestApplication {

    public static void main(String[] args) {
        SpringApplication.run(InfoDigestApplication.class, args);
    }

}
