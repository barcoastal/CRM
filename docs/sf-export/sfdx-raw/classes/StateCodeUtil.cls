public with sharing class StateCodeUtil {

    public static Map<String, String> stateCodeStateMap = new Map<String, String> {
        'al' => 'alabama', 'alabama' => 'al',
        'ak' => 'alaska', 'alaska' => 'ak',
        'ab' => 'alberta', 'alberta' => 'ab',
        'az' => 'arizona', 'arizona' => 'az',
        'ar' => 'arkansas', 'arkansas' => 'ar',
        'bc' => 'british columbia', 'british columbia' => 'bc',
        'ca' => 'california', 'california' => 'ca',
        'co' => 'colorado', 'colorado' => 'co',
        'ct' => 'connecticut', 'connecticut' => 'ct',
        'de' => 'delaware', 'delaware' => 'de',
        'dc' => 'district of columbia', 'district of columbia' => 'dc',
        'fl' => 'florida', 'florida' => 'fl',
        'ga' => 'georgia', 'georgia' => 'ga',
        'hi' => 'hawaii', 'hawaii' => 'hi',
        'id' => 'idaho', 'idaho' => 'id',
        'il' => 'illinois', 'illinois' => 'il',
        'in' => 'indiana', 'indiana' => 'in',
        'ia' => 'iowa', 'iowa' => 'ia',
        'ks' => 'kansas', 'kansas' => 'ks',
        'ky' => 'kentucky', 'kentucky' => 'ky',
        'la' => 'louisiana', 'louisiana' => 'la',
        'me' => 'maine', 'maine' => 'me',
        'mb' => 'manitoba', 'manitoba' => 'mb',
        'md' => 'maryland', 'maryland' => 'md',
        'ma' => 'massachusetts', 'massachusetts' => 'ma',
        'mi' => 'michigan', 'michigan' => 'mi',
        'mn' => 'minnesota', 'minnesota' => 'mn',
        'ms' => 'mississippi', 'mississippi' => 'ms',
        'mo' => 'missouri', 'missouri' => 'mo',
        'mt' => 'montana', 'montana' => 'mt',
        'ne' => 'nebraska', 'nebraska' => 'ne',
        'nv' => 'nevada', 'nevada' => 'nv',
        'nb' => 'new brunswick', 'new brunswick' => 'nb',
        'nh' => 'new hampshire', 'new hampshire' => 'nh',
        'nj' => 'new jersey', 'new jersey' => 'nj',
        'nm' => 'new mexico', 'new mexico' => 'nm',              
        'ny' => 'new york', 'new york' => 'ny',
        'nl' => 'newfoundland and labrador', 'newfoundland and labrador' => 'nl',
        'nc' => 'north carolina', 'north carolina' => 'nc',
        'nd' => 'north dakota', 'north dakota' => 'nd',
        'nt' => 'northwest territories', 'northwest territories' => 'nt', 
        'ns' => 'nova scotia', 'nova scotia' => 'ns',
        'nu' => 'nunavut', 'nunavut' => 'nu',
        'oh' => 'ohio', 'ohio' => 'oh',
        'ok' => 'oklahoma', 'oklahoma' => 'ok',
        'on' => 'ontario', 'ontario' => 'on',
        'or' => 'oregon', 'oregon' => 'or',
        'pa' => 'pennsylvania', 'pennsylvania' => 'pa',
        'pe' => 'prince edward island', 'prince edward island' => 'pe',
        'pr' => 'puerto rico', 'puerto rico' => 'pr',
        'qc' => 'quebec', 'quebec' => 'qc',
        'ri' => 'rhode island', 'rhode island' => 'ri',
        'sk' => 'saskatchewan', 'saskatchewan' => 'sk',
        'sc' => 'south carolina', 'south carolina' => 'sc',
        'sd' => 'south dakota', 'south dakota' => 'sd',
        'tn' => 'tennessee', 'tennessee' => 'tn',
        'tx' => 'texas', 'texas' => 'tx',
        'ut' => 'utah', 'utah' => 'ut',
        'vt' => 'vermont', 'vermont' => 'vt',
        'va' => 'virginia', 'virginia' => 'va',
        'vi' => 'virgin islands', 'virgin islands' => 'vi',                                                         
        'wa' => 'washington', 'washington' => 'wa',
        'wv' => 'west virginia', 'west virginia' => 'wv',
        'wi' => 'wisconsin', 'wisconsin' => 'wi',
        'wy' => 'wyoming', 'wyoming' => 'wy',
        'yt' => 'yukon', 'yukon' => 'yt'
        
   };
   
    public static Boolean isValidState(String stateValue) {
        if (String.isNotBlank(stateValue)) {
            return stateCodeStateMap.containsKey(stateValue.toLowerCase());
        }
        return false;
    }

    public static String getUSStateAbbreviation(String stateValue) {
        String stateAbbreviation;
        if (String.isNotBlank(stateValue)) {
            if (stateValue.length() == 2) {
                stateAbbreviation = stateValue.toUpperCase();
            } else {
                stateValue = stateValue.toLowerCase();
                if (stateCodeStateMap.containsKey(stateValue)) {
                    stateAbbreviation = stateCodeStateMap.get(stateValue).toUpperCase();
                }
            }
        }
        return stateAbbreviation;
    }
    
    /**
     * @description: Method to validate the given state(supports state code) falls in no business states or not. This supports both abbrevated state value and its code value.
     * @param stateValue - state value from various objects.
     * @return true or false
    */
    public static Boolean isNoBusinessState(String stateValue) {
        Boolean isNoBusinessState = false;
        if (isValidState(stateValue)) {
            Set<String> noBusinessStateSet = NoBusinessStateSettingMDT.getNoBusinessStates();
            stateValue = stateValue.toLowerCase();
            if (noBusinessStateSet.contains(stateValue) || noBusinessStateSet.contains(stateCodeStateMap.get(stateValue))) {
                isNoBusinessState = true;
            }
        }
        return isNoBusinessState;
    }
}