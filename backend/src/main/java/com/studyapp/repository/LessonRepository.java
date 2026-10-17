package com.studyapp.repository;

import com.studyapp.model.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface LessonRepository extends JpaRepository<Lesson, UUID> {
    List<Lesson> findBySectionIdOrderBySortOrderAsc(UUID sectionId);
    List<Lesson> findByScheduledDateLessThanEqualAndStatusNotOrderByScheduledDateAscSortOrderAsc(LocalDate date, String status);
    List<Lesson> findByScheduledDateOrderBySortOrderAsc(LocalDate date);
    long countByStatus(String status);
}
