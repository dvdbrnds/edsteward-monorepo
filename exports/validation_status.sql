-- Export for table: validation_status
-- Exported on: 2025-05-29T18:37:07.785Z

-- Data for validation_status
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (1, 4896, 5, 'A', 'passed', '{"errors":[]}', '2025-02-21T05:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (2, 4896, 5, 'B', 'passed', '{"errors":[]}', '2025-02-21T05:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (3, 4896, 5, 'C', 'passed', '{"errors":[]}', '2025-02-21T05:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (4, 4896, 5, 'D', 'failed', '{"errors":[{"code":"ERR_D_XREF","field":"requirements","message":"Cross-reference to emergency response plan needed","severity":"warning"}]}', '2025-02-21T05:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (5, 4896, 6, 'A', 'passed', '{"errors":[]}', '2025-03-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (6, 4896, 6, 'B', 'passed', '{"errors":[]}', '2025-03-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (7, 4896, 6, 'C', 'passed', '{"errors":[]}', '2025-03-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (8, 4896, 6, 'D', 'passed', '{"errors":[]}', '2025-03-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (9, 4897, 8, 'A', 'passed', '{"errors":[]}', '2025-03-16T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (10, 4897, 8, 'B', 'passed', '{"errors":[]}', '2025-03-16T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (11, 4897, 8, 'C', 'failed', '{"errors":[{"code":"ERR_C_INCOMPLETE","field":"requirements","message":"Clarity needed on audit procedure requirements","severity":"error"}]}', '2025-03-16T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (12, 4897, 8, 'D', 'pending', '{"errors":[]}', '2025-03-16T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (13, 4900, 11, 'A', 'passed', '{"errors":[]}', '2025-07-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (14, 4900, 11, 'B', 'passed', '{"errors":[]}', '2025-07-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (15, 4900, 11, 'C', 'passed', '{"errors":[]}', '2025-07-11T04:00:00.000Z', 5);
INSERT INTO validation_status (id, regulation_id, version_id, level, status, details, validated_at, validated_by) VALUES (16, 4900, 11, 'D', 'in_progress', '{"errors":[{"code":"ERR_D_REVIEW","field":"requirements","message":"Reviewing cross-references to institution policies","severity":"warning"}]}', '2025-07-11T04:00:00.000Z', 5);

