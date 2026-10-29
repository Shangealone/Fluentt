import {StyleSheet} from "react-native";
import {homeColors as c} from "../../theme/personal";
export const a=StyleSheet.create({
  safe:{flex:1,backgroundColor:c.background},flex:{flex:1},
  content:{width:"100%",maxWidth:460,alignSelf:"center",paddingHorizontal:20,paddingTop:12,paddingBottom:32,gap:22},
  top:{flexDirection:"row",alignItems:"center",gap:12},back:{width:44,minHeight:44,alignItems:"center",justifyContent:"center",backgroundColor:"#EDF2E9",borderRadius:22},backText:{fontSize:30,color:c.ink},
  intro:{gap:10,paddingTop:8},art:{width:72,height:72,borderRadius:22,backgroundColor:"#E7F1CF",alignItems:"center",justifyContent:"center",marginBottom:4},heroImage:{width:56,height:56},
  title:{fontSize:30,lineHeight:37,fontWeight:"700",letterSpacing:-.9,color:c.ink},description:{fontSize:14,lineHeight:22,color:c.muted},
  card:{borderWidth:1,borderColor:c.line,borderRadius:24,backgroundColor:"#FFFFFF",padding:18,gap:20},
  tabs:{flexDirection:"row",backgroundColor:"#F1F4EC",borderRadius:14,padding:4,gap:4},
  tab:{flex:1,paddingHorizontal:8,paddingVertical:12,minHeight:48,justifyContent:"center",borderRadius:11},selectedTab:{backgroundColor:"#FFFFFF"},
  tabText:{fontSize:13,lineHeight:19,textAlign:"center",color:c.muted,fontWeight:"600"},selectedTabText:{color:c.teal,fontWeight:"700"},
  field:{gap:8},label:{fontSize:14,lineHeight:21,fontWeight:"700",color:c.ink},
  codeAction:{minHeight:46,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#E7F1CF",paddingHorizontal:14},codeActionText:{fontSize:14,fontWeight:"700",color:c.teal},
  classPreview:{gap:5,backgroundColor:"#F5F8EC",borderWidth:1,borderColor:"#D5E3C8",borderRadius:14,padding:14},previewHeading:{fontSize:16,lineHeight:23,fontWeight:"700",color:c.ink},previewNote:{fontSize:12,lineHeight:19,fontWeight:"600",color:c.teal},
  input:{borderWidth:1,borderColor:"#CCD8CE",borderRadius:12,minHeight:52,paddingHorizontal:14,paddingVertical:14,fontSize:16,color:c.ink,backgroundColor:"#FCFDF9"},
  hint:{fontSize:12,lineHeight:19,color:c.muted},passwordRow:{flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:"#CCD8CE",borderRadius:12,backgroundColor:"#FCFDF9"},password:{flex:1,minWidth:0,borderWidth:0,backgroundColor:"transparent"},show:{minWidth:54,minHeight:48,paddingHorizontal:10,justifyContent:"center"},showText:{fontSize:12,fontWeight:"700",color:c.teal},
  roles:{gap:8},role:{flexDirection:"row",alignItems:"center",gap:10,padding:10,borderRadius:14,borderWidth:1,borderColor:c.line},selectedRole:{backgroundColor:c.selected,borderColor:c.teal},roleIcon:{width:43,height:43,borderRadius:12,alignItems:"center",justifyContent:"center"},roleImage:{width:34,height:34},roleCopy:{flex:1,minWidth:0},roleTitle:{fontSize:14,lineHeight:21,fontWeight:"700",color:c.ink},radio:{fontSize:23,color:c.teal},
  submit:{backgroundColor:c.coral,borderRadius:14,paddingHorizontal:14,paddingVertical:16,minHeight:54,justifyContent:"center"},submitText:{fontSize:16,lineHeight:23,fontWeight:"700",color:"#FFFFFF",textAlign:"center"},dim:{opacity:.65},error:{fontSize:13,lineHeight:21,color:"#A62F2E",backgroundColor:"#FFF0ED",padding:12,borderRadius:12},footer:{fontSize:12,lineHeight:19,textAlign:"center",color:c.muted},
});
