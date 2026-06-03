public inherited sharing class AccountTeamMemberData {
    public static List<AccountTeamMember> getAccountTeamMembers(Set<Id> ownerChangedAccountIds) {
        return [SELECT Id, AccountAccessLevel, AccountId, CaseAccessLevel, ContactAccessLevel,
            OpportunityAccessLevel, TeamMemberRole, UserId FROM AccountTeamMember 
            WHERE AccountId IN :ownerChangedAccountIds AND User.IsActive = true
        ];
    }
}