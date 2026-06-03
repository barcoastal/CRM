public inherited sharing class SetupObjectData {
    public static List<CustomNotificationType> queryCustomNotificationType(String notificationTypeName) {
        return [SELECT Id, DeveloperName 
            FROM CustomNotificationType 
            WHERE DeveloperName = :notificationTypeName
        ];
    }
}