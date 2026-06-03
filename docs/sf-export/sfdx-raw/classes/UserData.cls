public inherited sharing class UserData {
    
    /**
     * @description: method to query the current user record with the list of lead fields.
     * @param1: Set<String> fields - the collection of the user fields to be queried
     * @returnType: List<User>
    */
    public static List<User> queryCurrentUser(Set<String> fields) {
        List<String> fieldsList = new List<String>(fields);
        String fieldString = String.join(fieldsList, ', ');
        Id userId = UserInfo.getUserId();
        String query = 'SELECT ' + fieldString + ' FROM User WHERE Id = :userId';
        return Database.query(query);
    }  
    
    public static list<User> queryActiveUsers(){
        return [SELECT Id, Name FROM User WHERE IsActive = true];
    }

    public static List<User> queryBuyoutClosers() {
        String buyoutCloserEmail = BuyoutSettingsUtil.getBuyoutCloserEmail();
        return [SELECT Id FROM User WHERE Email = :buyoutCloserEmail];
    }

    public static List<User> queryDefaultSalesAdmin() {
        String defaultSalesAdminEmail = BuyoutSettingsUtil.getBackOfficeDefaultUserEmail();
        return [SELECT Id FROM User WHERE Email = :defaultSalesAdminEmail];
    }
    
	public static List<User> queryActiveClsoers(){
        return [SELECT Id, Name FROM User WHERE IsActive = true AND Profile.Name = 'Closer'];
    }

    public static List<User> getUserByEmail(String email) {
        return [
            SELECT Id, Name, Email
            FROM User
            WHERE Email = :email
            LIMIT 1
        ];
    }
}