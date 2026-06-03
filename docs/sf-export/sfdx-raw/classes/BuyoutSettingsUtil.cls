public inherited sharing class BuyoutSettingsUtil {
    
    private static Map<String, Buyout_Settings__mdt> settingsMap = new Map<String, Buyout_Settings__mdt>(); 
    
    static {
        settingsMap.putAll(Buyout_Settings__mdt.getAll());
    }

    public static String getBuyoutCloserEmail() {
        return (!settingsMap.isEmpty() && settingsMap.get('Buyout_Settings') != null) ? settingsMap.get('Buyout_Settings').Buyout_Closer_Email__c : '';
    }

    public static String getBackOfficeDefaultUserEmail() {
        return (!settingsMap.isEmpty() && settingsMap.get('Buyout_Settings') != null) ? settingsMap.get('Buyout_Settings').Back_Office_Default_User_Email__c : '';
    }
}