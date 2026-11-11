import { query } from "./db.js";
import { calculatePriorities } from "./priority.js";

// Loads a user's subjects and upcoming exams, then ranks the subjects.
export async function loadPriorities(userId) {
  const subjectResult = await query(
    `SELECT s.id, s.name, s.weight,
            (SELECT ROUND(AVG(a.marks / a.max_marks * 100), 1)
               FROM assessments a
              WHERE a.subject_id = s.id) AS average_percent
       FROM subjects s
      WHERE s.user_id = $1`,
    [userId]
  );

  const examResult = await query(
    `SELECT subject_id, exam_at, importance
       FROM exams
      WHERE user_id = $1 AND exam_at > now()`,
    [userId]
  );

  const subjects = subjectResult.rows.map((r) => ({
    id: r.id,
    name: r.name,
    weight: Number(r.weight),
    averagePercent: r.average_percent === null ? null : Number(r.average_percent),
  }));

  const exams = examResult.rows.map((r) => ({
    subjectId: r.subject_id,
    examAt: new Date(r.exam_at),
    importance: Number(r.importance),
  }));

  return calculatePriorities(subjects, exams);
}