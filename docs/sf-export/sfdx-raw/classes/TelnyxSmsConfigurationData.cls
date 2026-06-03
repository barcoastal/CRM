public class TelnyxSmsConfigurationData {
    public static List<Telnyx_SMS_Configuration__mdt> getTelnyxConfig(String metadataName) {
        List<Telnyx_SMS_Configuration__mdt> configurationRecords = [
            SELECT Endpoint__c, Token__c
            FROM Telnyx_SMS_Configuration__mdt
            WHERE DeveloperName = :metadataName
            LIMIT 1
        ];
        return configurationRecords;
    }
}