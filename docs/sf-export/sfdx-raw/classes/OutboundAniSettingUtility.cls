public class OutboundAniSettingUtility {
    
    private static Map<String, OutboundAni_Settings__mdt> settingsMap = new Map<String, OutboundAni_Settings__mdt>(); 
    
    static {
        settingsMap.putAll(OutboundAni_Settings__mdt.getAll());
    }
    
    public static String getEndPoint(){
        return !settingsMap.isEmpty() && settingsMap.get('End_Point') != null ? settingsMap.get('End_Point').value__c : null; 
    }
    
    
    public static String getApiKey(){ 
        return !settingsMap.isEmpty() && settingsMap.get('Api_Key') != null ? settingsMap.get('Api_Key').value__c : null;
    }
    
}