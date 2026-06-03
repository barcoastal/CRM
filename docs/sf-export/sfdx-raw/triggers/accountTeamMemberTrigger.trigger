trigger accountTeamMemberTrigger on AccountTeamMember (after update) {
    new AccountTeamMemberHandler().run();
}