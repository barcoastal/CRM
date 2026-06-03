public inherited sharing class UserUtil {
    private static final Schema.DescribeSObjectResult USER_DESCRIBE = Schema.SObjectType.User;
    
    //To get the API Name of the User Object
    public String getSObjName() {
        return USER_DESCRIBE.getName();
    }

    /**
     * @description getUserIdByUserName description
     * @param  userName salesforce username
     * @return          salesforce userId
     */
    public static Id getUserIdByUserName(String userName) {

        Id userId;
        try {
            List<User>    users = [SELECT Id, UserName, Email FROM User WHERE UserName =:userName]; //No PMD
           
            if (users.size() > 0) {
                userId = users.get(0).Id;
            }
            return userId;
        } catch (Exception e) {
            
            ApplicationLogger.logDMLException('User Query Failed', null, e.getMessage());
        }
        return userId;
    }

    public static Map<String, Id> getUserMapByUserNames(Set<String> userNames) {

        Map<String, Id> userNameMap = new Map<String, Id>();

        for (User usr : [
            SELECT Id, Name 
            FROM User 
            WHERE Name IN :userNames
        ]) {
            userNameMap.put(usr.Name, usr.Id);
        }

        return userNameMap;
    }
}