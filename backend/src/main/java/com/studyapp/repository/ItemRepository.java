package com.studyapp.repository;

import com.studyapp.model.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ItemRepository extends JpaRepository<Item, UUID> {
    List<Item> findByLessonId(UUID lessonId);
    List<Item> findByLessonIdIn(List<UUID> lessonIds);
}
