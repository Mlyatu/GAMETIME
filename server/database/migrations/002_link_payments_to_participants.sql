ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS participant_id BIGINT REFERENCES tournament_participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_participant ON payments(participant_id);

WITH unambiguous_registrations AS (
    SELECT p.id AS payment_id, MIN(tp.id) AS participant_id
    FROM payments p
    JOIN tournament_participants tp
      ON tp.tournament_id = p.tournament_id
     AND tp.status = 'pending'
    LEFT JOIN teams tm ON tm.id = tp.team_id
    WHERE p.tournament_id IS NOT NULL
      AND p.participant_id IS NULL
      AND (tp.user_id = p.user_id OR tm.captain_id = p.user_id)
      AND (
          SELECT COUNT(*)
          FROM payments other_payment
          WHERE other_payment.user_id = p.user_id
            AND other_payment.tournament_id = p.tournament_id
      ) = 1
    GROUP BY p.id
    HAVING COUNT(DISTINCT tp.id) = 1
)
UPDATE payments p
SET participant_id = registration.participant_id
FROM unambiguous_registrations registration
WHERE p.id = registration.payment_id;
