-- Gruvbox Light 主题配置
return {
  -- 安装 gruvbox 主题
  {
    "ellisonleao/gruvbox.nvim",
    priority = 1000, -- 确保优先加载
    config = function()
      require("gruvbox").setup({
        contrast = "hard", -- 可选: "hard", "soft", 或不设置
        dim_inactive = false,
        transparent_mode = false,
      })
      -- 设置为浅色主题
      vim.o.background = "light"
    end,
  },

  -- 配置 LazyVim 使用 gruvbox
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "gruvbox",
    },
  },
}
