// =====================================================================
// TEAM ROUTES — /api/team
// =====================================================================

const express = require('express');
const router = express.Router();

const teamController = require('../controllers/team.controller');
const requireAuth = require('../middleware/auth');
const { handleValidationErrors } = require('../validators/auth.validator');
const { createTeamValidator, updateTeamValidator, addMemberValidator } = require('../validators/team.validator');

router.get('/', teamController.listTeams);
router.post('/', requireAuth, createTeamValidator, handleValidationErrors, teamController.createTeam);

router.get('/:uuid', teamController.getTeam);
router.patch('/:uuid', requireAuth, updateTeamValidator, handleValidationErrors, teamController.updateTeam);
router.delete('/:uuid', requireAuth, teamController.deleteTeam);

router.post('/:uuid/members', requireAuth, addMemberValidator, handleValidationErrors, teamController.addMember);
router.delete('/:uuid/members/:username', requireAuth, teamController.removeMember);

module.exports = router;
