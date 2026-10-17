package com.studyapp.repository;

import com.studyapp.model.ReviewLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewLogRepository extends JpaRepository<ReviewLog, UUID> {
    List<ReviewLog> findTop50ByOrderByAtDesc();

    @Query("SELECT r.itemId, COUNT(r) as failCount FROM ReviewLog r WHERE r.correct = false GROUP BY r.itemId ORDER BY failCount DESC LIMIT 10")
    List<Object[]> findTopFailedItems();
}
