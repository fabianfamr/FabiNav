!macro customInstall
  CreateShortCut "$SMPROGRAMS\FabiNav\Desinstalar FabiNav.lnk" "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe" "" "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\FabiNav\Desinstalar FabiNav.lnk"
  RMDir "$SMPROGRAMS\FabiNav"
!macroend
