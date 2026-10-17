package com.studyapp.repository;

import com.studyapp.model.ItemState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ItemStateRepository extends JpaRepository<ItemState, UUID> {
    List<ItemState> findByDueAtLessThanEqualOrderByDueAtAsc(OffsetDateTime dueBefore);
    List<ItemState> findByOrderByLapsesDescEaseAsc();
    long countByIntervalDaysGreaterThanEqual(int days);
}
