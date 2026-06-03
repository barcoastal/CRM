/*----------------------------------------------------------------
    Author: Vignesh P
    Description: A data class to perform query actions in the Team Member object
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>  
    Oct-02-2024     Vignesh                  Initial Development                
--------------------------------------------------------------------*/
public inherited sharing class TeamMemberData {
    
    /**
     * @description: Querying the Account Team Members of the Accounts which are related to
     * Customer Services Rep
    **/
    public static List<AccountTeamMember> queryAccountTeamMembersCustSvcRep(Set<Id> accountIds) {
        return [SELECT Id, AccountId, UserId FROM AccountTeamMember 
            WHERE AccountId IN :accountIds
            AND TeamMemberRole = :TeamMemberUtil.ROLE_CLOSER
        ];
    }   
}