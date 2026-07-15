package com.infodigest.repository;

import com.infodigest.entity.UserPlatform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserPlatformRepository extends JpaRepository<UserPlatform, Long> {
    List<UserPlatform> findByUserId(Long userId);
    Optional<UserPlatform> findByUserIdAndPlatform(Long userId, String platform);
    void deleteByUserIdAndPlatform(Long userId, String platform);
}
